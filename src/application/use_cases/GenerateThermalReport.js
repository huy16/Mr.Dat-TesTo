const path = require('path');
const fs = require('fs');

class GenerateThermalReport {
    constructor(bmtRepository, reportService) {
        this.bmtRepository = bmtRepository;
        this.reportService = reportService;
    }

    async execute(files, remarks, conclusions, recommendations, tempDir, reportTitle, deviceType = "solar_panel") {
        const thermalImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const remark = remarks[i] || ""; // Match by index
            const conclusion = conclusions[i] || "";
            const recommendation = recommendations[i] || "";
            const bmtPath = file.path;
            try {
                // Parse BMT to get Entity
                // Pass originalname to keep correct file identity
                const thermalImage = await this.bmtRepository.parse(bmtPath, tempDir, file.originalname);
                thermalImage.remarks = remark; // Set remark
                thermalImage.conclusion = conclusion;
                thermalImage.recommendation = recommendation;

                // Calculate Severity based on Device Type
                let warningThreshold = 45;
                let criticalThreshold = 65;

                switch (deviceType) {
                    case 'inverter':
                        warningThreshold = 60;
                        criticalThreshold = 80;
                        break;
                    case 'cable':
                        warningThreshold = 70;
                        criticalThreshold = 90;
                        break;
                    case 'solar_panel':
                    default:
                        warningThreshold = 45;
                        criticalThreshold = 65;
                        break;
                }

                const maxTemp = parseFloat(thermalImage.maxTemp);
                if (!isNaN(maxTemp)) {
                    if (maxTemp >= criticalThreshold) {
                        thermalImage.severity = "Critical";
                    } else if (maxTemp >= warningThreshold) {
                        thermalImage.severity = "Warning";
                    } else {
                        thermalImage.severity = "Normal";
                    }

                    // Auto-generate Conclusion & Recommendation if empty
                    if (!thermalImage.conclusion) {
                        switch (thermalImage.severity) {
                            case "Normal":
                                thermalImage.conclusion = "Hệ thống hoạt động bình thường. Nhiệt độ nằm trong giới hạn cho phép.";
                                if (deviceType === 'cable') thermalImage.conclusion = "Điểm đấu nối có nhiệt độ bình thường.";
                                break;
                            case "Warning":
                                thermalImage.conclusion = "Phát hiện tăng nhiệt cục bộ. Có thể do lỗi tiếp xúc, quá tải nhẹ hoặc bóng che.";
                                if (deviceType === 'solar_panel') thermalImage.conclusion = "Phát hiện tăng nhiệt bất thường. Có thể do bụi bẩn, bóng che hoặc lỗi nhẹ.";
                                break;
                            case "Critical":
                                thermalImage.conclusion = "Phát hiện lỗi quá nhiệt nghiêm trọng. Nguy cơ hư hỏng thiết bị hoặc cháy nổ.";
                                if (deviceType === 'solar_panel') thermalImage.conclusion = "Phát hiện lỗi Hotspot nghiêm trọng trên tấm pin.";
                                break;
                        }
                    }

                    if (!thermalImage.recommendation) {
                        switch (thermalImage.severity) {
                            case "Normal":
                                thermalImage.recommendation = "Tiếp tục theo dõi định kỳ.";
                                break;
                            case "Warning":
                                thermalImage.recommendation = "Kiểm tra vệ sinh bề mặt, siết lại điểm đấu nối và theo dõi trong lần kiểm tra tới.";
                                if (deviceType === 'solar_panel') thermalImage.recommendation = "Vệ sinh tấm pin, kiểm tra vật cản và theo dõi thêm.";
                                break;
                            case "Critical":
                                thermalImage.recommendation = "Cần kiểm tra kỹ thuật ngay lập tức! Đo dòng điện, kiểm tra lực siết hoặc thay thế.";
                                if (deviceType === 'solar_panel') thermalImage.recommendation = "Kiểm tra kỹ thuật tại hiện trường, đo đạc lại và cân nhắc thay thế tấm pin.";
                                break;
                        }
                    }
                }

                thermalImages.push(thermalImage);
            } finally {
                // Cleanup upload
                if (fs.existsSync(bmtPath)) fs.unlinkSync(bmtPath);
            }
        }

        const reportName = `Report_${Date.now()}.pdf`;
        const reportPath = path.join(tempDir, reportName);

        // Generate Report
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
