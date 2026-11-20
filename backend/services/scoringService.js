// DỊCH VỤ CHẤM ĐIỂM, HỆ SỐ TỐC ĐỘ & TÍNH ELO CHUẨN QUỐC TẾ (scoringService.js)
function getSpeedMultiplier(elapsedMs) {
    const minutes = Math.floor(elapsedMs / 60000);
    if (minutes < 1) return 6;
    if (minutes < 2) return 5;
    if (minutes < 3) return 4;
    if (minutes < 4) return 3;
    if (minutes < 5) return 2;
    return 1;
}

function calculateStandardElo(ratingA, ratingB, scoreA, isBothFailed = false) {
    const K = isBothFailed ? 12 : 24;
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    return Math.round(K * (scoreA - expectedA));
}

module.exports = {
    getSpeedMultiplier,
    calculateStandardElo
};
