const path = require('path');
const fs = require('fs');
const DeviceClassifier = require('../../domain/services/DeviceClassifier');

class GenerateThermalReport {
    constructor(bmtRepository, reportService) {
        this.bmtRepository = bmtRepository;
        this.reportService = reportService;
    }

    async execute(files, remarks, conclusions, recommendations, tempDir, reportTitle, manualCategory) {
        const thermalImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const remark = remarks[i] || "";
            const conclusion = conclusions[i] || "";
            const recommendation = recommendations[i] || "";
            const bmtPath = file.path;
            try {
                // Parse BMT to get Entity
                const thermalImage = await this.bmtRepository.parse(bmtPath, tempDir, file.originalname);
                thermalImage.remarks = remark;
                thermalImage.conclusion = conclusion;
                thermalImage.recommendation = recommendation;

                // Force user-selected device category. File might still be logged for debugging.
                const deviceType = manualCategory;
                thermalImage.deviceType = deviceType;

                console.log(`[Auto-Detect] ${file.originalname} → ${DeviceClassifier.getLabel(deviceType)} (max: ${thermalImage.maxTemp}°C, range: ${(parseFloat(thermalImage.maxTemp) - parseFloat(thermalImage.minTemp)).toFixed(1)}°C)`);

                // Get thresholds for this specific device type
                const { warning: warningThreshold, critical: criticalThreshold } = DeviceClassifier.getThresholds(deviceType);

                const maxTemp = parseFloat(thermalImage.maxTemp);
                if (!isNaN(maxTemp)) {
                    if (maxTemp >= criticalThreshold) {
                        thermalImage.severity = "Critical";
                    } else if (maxTemp >= warningThreshold) {
                        thermalImage.severity = "Warning";
                    } else {
                        thermalImage.severity = "Normal";
                    }

                    // Auto-generate Conclusion & Recommendation if empty (Vietnamese)
                    if (!thermalImage.conclusion) {
                        switch (thermalImage.severity) {
                            case "Normal":
                                if (deviceType === 'cable') {
                                    thermalImage.conclusion = "Nhiệt độ điểm đấu nối cáp nằm trong giới hạn bình thường.";
                                } else if (deviceType === 'cabinet') {
                                    thermalImage.conclusion = "Tủ điện/Inverter hoạt động ở nhiệt độ bình thường.";
                                } else {
                                    thermalImage.conclusion = "Hệ thống hoạt động bình thường. Nhiệt độ nằm trong giới hạn cho phép.";
                                }
                                break;
                            case "Warning":
                                if (deviceType === 'cable') {
                                    thermalImage.conclusion = "Phát hiện tăng nhiệt tại điểm đấu nối cáp. Có thể do tiếp xúc kém hoặc quá tải nhẹ.";
                                } else if (deviceType === 'cabinet') {
                                    thermalImage.conclusion = "Phát hiện tăng nhiệt bất thường trong tủ điện/Inverter.";
                                } else {
                                    thermalImage.conclusion = "Phát hiện tăng nhiệt bất thường. Có thể do bụi bẩn, bóng che hoặc lỗi nhẹ trên tấm pin.";
                                }
                                break;
                            case "Critical":
                                if (deviceType === 'cable') {
                                    thermalImage.conclusion = "Quá nhiệt nghiêm trọng tại điểm đấu nối cáp. Nguy cơ hư hỏng hoặc cháy nổ.";
                                } else if (deviceType === 'cabinet') {
                                    thermalImage.conclusion = "Quá nhiệt nghiêm trọng trong tủ điện/Inverter. Cần xử lý ngay lập tức.";
                                } else {
                                    thermalImage.conclusion = "Phát hiện lỗi Hotspot nghiêm trọng trên tấm pin. Hư hỏng nặng.";
                                }
                                break;
                        }
                    }

                    if (!thermalImage.recommendation) {
                        switch (thermalImage.severity) {
                            case "Normal":
                                thermalImage.recommendation = "Tiếp tục theo dõi định kỳ theo lịch bảo trì.";
                                break;
                            case "Warning":
                                if (deviceType === 'cable') {
                                    thermalImage.recommendation = "Kiểm tra lực siết đầu cốt, vệ sinh tiếp điểm và theo dõi trong lần kiểm tra tới.";
                                } else if (deviceType === 'cabinet') {
                                    thermalImage.recommendation = "Kiểm tra hệ thống thông gió, quạt làm mát và phân bổ tải.";
                                } else {
                                    thermalImage.recommendation = "Vệ sinh bề mặt tấm pin, kiểm tra vật cản và theo dõi thêm.";
                                }
                                break;
                            case "Critical":
                                if (deviceType === 'cable') {
                                    thermalImage.recommendation = "Cần kiểm tra ngay! Đo dòng điện, kiểm tra lực siết hoặc thay thế đầu nối.";
                                } else if (deviceType === 'cabinet') {
                                    thermalImage.recommendation = "Cần kiểm tra ngay! Kiểm tra linh kiện bên trong và cân nhắc ngắt tải.";
                                } else {
                                    thermalImage.recommendation = "Kiểm tra kỹ thuật tại hiện trường, đo đạc lại và cân nhắc thay thế tấm pin.";
                                }
                                break;
                        }
                    }
                }

                thermalImages.push(thermalImage);
            } finally {
                if (fs.existsSync(bmtPath)) fs.unlinkSync(bmtPath);
            }
        }

        // Sort by category (PV → Cable → Cabinet) then by filename
        DeviceClassifier.sortByCategory(thermalImages);

        const reportName = `Report_${Date.now()}.pdf`;
        const reportPath = path.join(tempDir, reportName);

        await this.reportService.generate(thermalImages, reportPath, reportTitle);

        return {
            reportPath,
            reportName,
            cleanup: () => {
                if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
                thermalImages.forEach(img => {
                    if (fs.existsSync(img.thermalImagePath)) fs.unlinkSync(img.thermalImagePath);
                    if (img.realImagePath && fs.existsSync(img.realImagePath)) fs.unlinkSync(img.realImagePath);
                });
            }
        };
    }
}

module.exports = GenerateThermalReport;
