import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blood-ai-recommendations-'));
process.env.DATA_DIR = dataDir;
process.env.FORECAST_PROVIDER = 'statistical';

try {
    const dateDaysAgo = days => {
        const date = new Date();
        date.setUTCHours(12, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - days);
        return date.toISOString();
    };
    const dateDaysFromNow = days => {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    };
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const thresholds = Object.fromEntries(groups.map(group => [group, { critical: 0, low: 0, ideal: 30 }]));
    thresholds['O-'] = { critical: 5, low: 10, ideal: 20 };
    thresholds['B+'] = { critical: 0, low: 0, ideal: 10 };
    const units = [
        { id: 'o-prbc-available', unitCode: 'O-PRBC-1', bloodGroup: 'O-', component: 'PRBC', status: 'AVAILABLE', expiryDate: dateDaysFromNow(20) },
        { id: 'o-whole-expiring', unitCode: 'O-WB-EXP', bloodGroup: 'O-', component: 'WHOLE_BLOOD', status: 'AVAILABLE', expiryDate: dateDaysFromNow(1) },
        { id: 'o-prbc-reserved', unitCode: 'O-PRBC-R', bloodGroup: 'O-', component: 'PRBC', status: 'RESERVED', expiryDate: dateDaysFromNow(20) },
        { id: 'o-expired-available', unitCode: 'O-OLD', bloodGroup: 'O+', component: 'PRBC', status: 'AVAILABLE', expiryDate: dateDaysFromNow(-1) },
        ...Array.from({ length: 21 }, (_, index) => ({
            id: `b-prbc-reserved-${index}`,
            unitCode: `B-PRBC-R-${index}`,
            bloodGroup: 'B+',
            component: 'PRBC',
            status: 'RESERVED',
            expiryDate: dateDaysFromNow(40)
        })),
        ...Array.from({ length: 20 }, (_, index) => ({
            id: `b-prbc-${index}`,
            unitCode: `B-PRBC-${index}`,
            bloodGroup: 'B+',
            component: 'PRBC',
            status: 'AVAILABLE',
            expiryDate: dateDaysFromNow(40)
        }))
    ];
    const transactions = [];
    for (const daysAgo of[1, 4, 8]) {
        transactions.push({ id: `o-issue-${daysAgo}`, operation: 'ISSUE', bloodGroup: 'O-', component: 'PRBC', quantity: 20, timestamp: dateDaysAgo(daysAgo) });
        transactions.push({ id: `b-issue-${daysAgo}`, operation: 'USE', bloodGroup: 'B+', component: 'PRBC', quantity: 1, timestamp: dateDaysAgo(daysAgo) });
    }
    transactions.push({ id: 'not-demand', operation: 'RESERVE', bloodGroup: 'O-', component: 'PRBC', quantity: 100, timestamp: dateDaysAgo(1) });

    await fs.writeFile(path.join(dataDir, 'settings.json'), JSON.stringify({ expiryNoticeDays: 7, thresholds }));
    await fs.writeFile(path.join(dataDir, 'units.json'), JSON.stringify(units));
    await fs.writeFile(path.join(dataDir, 'transactions.json'), JSON.stringify(transactions));
    await fs.writeFile(path.join(dataDir, 'alerts.json'), JSON.stringify([
        { id: 'alert-o-low', type: 'LOW_STOCK', bloodGroup: 'O-', status: 'ACTIVE' }
    ]));
    await fs.writeFile(path.join(dataDir, 'recommendations.json'), JSON.stringify([
        { id: 'legacy-sample', status: 'PENDING', type: 'DONATION_DRIVE_RECOMMENDED', description: 'Unverified legacy example' }
    ]));

    const { recommendationService } = await
    import ('./src/services/recommendationService.js');
    const first = await recommendationService.generateRecommendations();
    const active = first.recommendations;
    const find = (type, group, component) => active.find(item => item.type === type && item.bloodGroup === group && (!component || item.component === component));

    const replenish = find('REPLENISH_STOCK', 'O-');
    assert.ok(replenish, 'below-critical inventory produces a replenishment recommendation');
    assert.equal(replenish.priority, 'CRITICAL');
    assert.equal(replenish.metadata.availableUnits, 2);
    assert.equal(replenish.metadata.reservedUnits, 1);
    assert.deepEqual(replenish.metadata.matchingAlertIds, ['alert-o-low']);
    assert.match(replenish.reason, /Forecasting was insufficient/);
    assert.equal(replenish.metadata.priorityBasis.some(item => item.includes('expiry window')), false);

    const highDemand = find('HIGH_DEMAND', 'O-', 'PRBC');
    assert.ok(highDemand, 'READY historical forecast exceeding component stock produces a high-demand recommendation');
    assert.equal(highDemand.metadata.availableUnits, 1);
    assert.ok(highDemand.metadata.forecastDemand > highDemand.metadata.availableUnits);

    const expiring = find('PRIORITIZE_EXPIRING', 'O-', 'WHOLE_BLOOD');
    assert.ok(expiring, 'available unit inside the expiry window produces a FIFO recommendation');
    assert.deepEqual(expiring.metadata.affectedUnitIds, ['o-whole-expiring']);
    assert.ok(find('EXPIRY_RISK', 'O+'), 'expired available inventory is flagged for quarantine review');
    assert.ok(find('EXCESS_STOCK', 'B+'), 'excess requires a ready group forecast and ideal threshold comparison');
    assert.ok(find('MONITOR_STOCK', 'B+'), 'reserved quantity greater than available stock is surfaced');
    assert.ok(active.every(item => item.source === 'DETERMINISTIC_ENGINE'));
    assert.equal(first.recommendations.some(item => item.id === 'legacy-sample'), false, 'unverified legacy records are not returned as active recommendations');

    const firstIds = active.map(item => item.id).sort();
    const second = await recommendationService.generateRecommendations();
    assert.deepEqual(second.recommendations.map(item => item.id).sort(), firstIds, 'repeated refresh upserts instead of duplicating records');

    const acknowledged = await recommendationService.updateStatus(highDemand.id, 'ACKNOWLEDGED', 'Reviewed', 'test-user');
    assert.equal(acknowledged.status, 'ACKNOWLEDGED');
    const afterAcknowledge = await recommendationService.generateRecommendations();
    assert.equal(afterAcknowledge.recommendations.find(item => item.id === highDemand.id).status, 'ACKNOWLEDGED');

    await recommendationService.updateStatus(highDemand.id, 'RESOLVED', 'Handled', 'test-user');
    const afterResolve = await recommendationService.generateRecommendations();
    assert.equal(afterResolve.recommendations.some(item => item.dedupeKey === highDemand.dedupeKey), false, 'a user-resolved condition is not immediately recreated');

    await fs.writeFile(path.join(dataDir, 'transactions.json'), JSON.stringify(transactions.filter(item => !item.id.startsWith('o-issue-'))));
    await recommendationService.generateRecommendations();
    await fs.writeFile(path.join(dataDir, 'transactions.json'), JSON.stringify(transactions));
    const recurrence = await recommendationService.generateRecommendations();
    const reopened = recurrence.recommendations.find(item => item.dedupeKey === highDemand.dedupeKey);
    assert.ok(reopened, 'a resolved recommendation can be generated again after its trigger clears and recurs');
    assert.notEqual(reopened.id, highDemand.id);

    console.log('Recommendation evidence, priority, deduplication, status lifecycle, and recurrence checks passed.');
} finally {
    await fs.rm(dataDir, { recursive: true, force: true });
}