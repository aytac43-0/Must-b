import CoreLocation
import Foundation
import MustBKit
import UIKit

typealias MustBCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias MustBCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: MustBCameraSnapParams) async throws -> MustBCameraSnapResult
    func clip(params: MustBCameraClipParams) async throws -> MustBCameraClipResult
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
    func ensureAuthorization(mode: MustBLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: MustBLocationGetParams,
        desiredAccuracy: MustBLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: MustBLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> MustBDeviceStatusPayload
    func info() -> MustBDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: MustBPhotosLatestParams) async throws -> MustBPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: MustBContactsSearchParams) async throws -> MustBContactsSearchPayload
    func add(params: MustBContactsAddParams) async throws -> MustBContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: MustBCalendarEventsParams) async throws -> MustBCalendarEventsPayload
    func add(params: MustBCalendarAddParams) async throws -> MustBCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: MustBRemindersListParams) async throws -> MustBRemindersListPayload
    func add(params: MustBRemindersAddParams) async throws -> MustBRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: MustBMotionActivityParams) async throws -> MustBMotionActivityPayload
    func pedometer(params: MustBPedometerParams) async throws -> MustBPedometerPayload
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
        params: MustBWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
