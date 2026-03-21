package ai.must-b.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class MustBProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", MustBCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", MustBCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", MustBCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", MustBCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", MustBCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", MustBCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", MustBCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", MustBCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", MustBCapability.Canvas.rawValue)
    assertEquals("camera", MustBCapability.Camera.rawValue)
    assertEquals("voiceWake", MustBCapability.VoiceWake.rawValue)
    assertEquals("location", MustBCapability.Location.rawValue)
    assertEquals("sms", MustBCapability.Sms.rawValue)
    assertEquals("device", MustBCapability.Device.rawValue)
    assertEquals("notifications", MustBCapability.Notifications.rawValue)
    assertEquals("system", MustBCapability.System.rawValue)
    assertEquals("photos", MustBCapability.Photos.rawValue)
    assertEquals("contacts", MustBCapability.Contacts.rawValue)
    assertEquals("calendar", MustBCapability.Calendar.rawValue)
    assertEquals("motion", MustBCapability.Motion.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", MustBCameraCommand.List.rawValue)
    assertEquals("camera.snap", MustBCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", MustBCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", MustBNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", MustBNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", MustBDeviceCommand.Status.rawValue)
    assertEquals("device.info", MustBDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", MustBDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", MustBDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", MustBSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", MustBPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", MustBContactsCommand.Search.rawValue)
    assertEquals("contacts.add", MustBContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", MustBCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", MustBCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", MustBMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", MustBMotionCommand.Pedometer.rawValue)
  }
}
