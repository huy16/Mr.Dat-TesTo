class ThermalImage {
    constructor(id, filename, createdAt, maxTemp, minTemp, centerTemp, reflectedTemp, emissivity, thermalImagePath, realImagePath, remarks = "", severity = "Normal", histogram = [], spots = null, conclusion = "", recommendation = "") {
        this.id = id;
        this.filename = filename;
        this.createdAt = createdAt; // Date object
        this.maxTemp = maxTemp;
        this.minTemp = minTemp;
        this.centerTemp = centerTemp;
        this.reflectedTemp = reflectedTemp;
        this.emissivity = emissivity;
        this.thermalImagePath = thermalImagePath;
        this.realImagePath = realImagePath;
        this.remarks = remarks;
        this.severity = severity;
        this.histogram = histogram;
        this.spots = spots;
        this.conclusion = conclusion;
        this.recommendation = recommendation;
    }
}

module.exports = ThermalImage;
