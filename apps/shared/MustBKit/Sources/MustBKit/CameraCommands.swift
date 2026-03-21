import Foundation

public enum MustBCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum MustBCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum MustBCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum MustBCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct MustBCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: MustBCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: MustBCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: MustBCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: MustBCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct MustBCameraClipParams: Codable, Sendable, Equatable {
    public var facing: MustBCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: MustBCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: MustBCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: MustBCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
