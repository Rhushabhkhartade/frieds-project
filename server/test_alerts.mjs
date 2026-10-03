import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blood-ai-alerts-'));
process.env.DATA_DIR = dataDir;

try {
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const thresholds = Object.fromEntries(groups.map(group => [
        group,
        group === 'A+' ? { critical: 1, low: 2, ideal: 10 } : { critical: -1, low: -1, ideal: 10 }
    ]));
    const expiryDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const expiredDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    await fs.writeFile(path.join(dataDir, 'settings.json'), JSON.stringify({ expiryNoticeDays: 7, thresholds }));
    const expiringUnit = {
        id: 'unit-expiring',
        unitCode: 'UNIT-EXP',
        bloodGroup: 'B+',
        component: 'PLATELETS',
        status: 'AVAILABLE',
        expiryDate
    };
    const expiredUnit = {
        id: 'unit-expired',
        unitCode: 'UNIT-OLD',
        bloodGroup: 'O-',
        component: 'WHOLE_BLOOD',
        status: 'AVAILABLE',
        expiryDate: expiredDate
    };
    await fs.writeFile(path.join(dataDir, 'units.json'), JSON.stringify([expiringUnit, expiredUnit]));
    await fs.writeFile(path.join(dataDir, 'alerts.json'), '[]');

    const { alertService } = await
    import ('./src/services/alertService.js');
    const initial = await alertService.refreshAlerts();
    assert.equal(initial.totalAlerts, 3, 'critical stock, expiring-soon, and expired alerts are generated');
    assert.equal((await alertService.refreshAlerts()).totalAlerts, 3, 'refresh does not duplicate active alerts');
    const expiring = initial.activeAlerts.find(alert => alert.type === 'EXPIRING_SOON');
    assert.equal(expiring.source, 'INVENTORY');
    assert.equal(expiring.referenceId, expiringUnit.id);
    assert.equal((await alertService.listAlerts({ source: 'INVENTORY', readState: 'UNREAD' })).pagination.total, 3);

    const critical = initial.activeAlerts.find(alert => alert.type === 'CRITICAL_STOCK');
    await alertService.setAlertReadState(critical.id, true, 'test-user');
    assert.equal((await alertService.getAlertSummary()).unread, 2, 'marking an alert read updates unread counts');
    await alertService.resolveAlert(critical.id, 'dismiss test', 'test-user');
    await alertService.refreshAlerts();
    assert.equal((await alertService.getAlertSummary()).unresolved, 2, 'dismissed active conditions do not immediately reappear');

    await fs.writeFile(path.join(dataDir, 'units.json'), JSON.stringify([
        { id: 'a1', bloodGroup: 'A+', status: 'AVAILABLE', expiryDate: '2027-01-01' },
        { id: 'a2', bloodGroup: 'A+', status: 'AVAILABLE', expiryDate: '2027-01-01' },
        { id: 'a3', bloodGroup: 'A+', status: 'AVAILABLE', expiryDate: '2027-01-01' },
        expiringUnit,
        expiredUnit
    ]));
    await alertService.refreshAlerts();
    await fs.writeFile(path.join(dataDir, 'units.json'), JSON.stringify([expiringUnit, expiredUnit]));
    const recurring = await alertService.refreshAlerts();
    assert.equal(recurring.totalAlerts, 4, 'a recovered condition can generate a new alert when it recurs');
    assert.equal(recurring.activeAlerts.filter(alert => alert.type === 'CRITICAL_STOCK').length, 1);

    console.log('Alert lifecycle checks passed.');
} finally {
    await fs.rm(dataDir, { recursive: true, force: true });
}