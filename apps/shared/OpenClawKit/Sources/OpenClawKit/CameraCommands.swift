import Foundation

public enum Must-bCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum Must-bCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum Must-bCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum Must-bCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct Must-bCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: Must-bCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: Must-bCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: Must-bCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: Must-bCameraImageFormat? = nil,
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

public struct Must-bCameraClipParams: Codable, Sendable, Equatable {
    public var facing: Must-bCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: Must-bCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: Must-bCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: Must-bCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
