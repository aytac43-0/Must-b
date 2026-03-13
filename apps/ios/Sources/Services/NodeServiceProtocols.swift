import CoreLocation
import Foundation
import Must-bKit
import UIKit

typealias Must-bCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias Must-bCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: Must-bCameraSnapParams) async throws -> Must-bCameraSnapResult
    func clip(params: Must-bCameraClipParams) async throws -> Must-bCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: Must-bLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: Must-bLocationGetParams,
        desiredAccuracy: Must-bLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: Must-bLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> Must-bDeviceStatusPayload
    func info() -> Must-bDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: Must-bPhotosLatestParams) async throws -> Must-bPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: Must-bContactsSearchParams) async throws -> Must-bContactsSearchPayload
    func add(params: Must-bContactsAddParams) async throws -> Must-bContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: Must-bCalendarEventsParams) async throws -> Must-bCalendarEventsPayload
    func add(params: Must-bCalendarAddParams) async throws -> Must-bCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: Must-bRemindersListParams) async throws -> Must-bRemindersListPayload
    func add(params: Must-bRemindersAddParams) async throws -> Must-bRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: Must-bMotionActivityParams) async throws -> Must-bMotionActivityPayload
    func pedometer(params: Must-bPedometerParams) async throws -> Must-bPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: Must-bWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
