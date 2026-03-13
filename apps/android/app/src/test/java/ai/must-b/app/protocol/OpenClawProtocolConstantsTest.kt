package ai.must-b.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class Must-bProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", Must-bCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", Must-bCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", Must-bCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", Must-bCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", Must-bCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", Must-bCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", Must-bCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", Must-bCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", Must-bCapability.Canvas.rawValue)
    assertEquals("camera", Must-bCapability.Camera.rawValue)
    assertEquals("voiceWake", Must-bCapability.VoiceWake.rawValue)
    assertEquals("location", Must-bCapability.Location.rawValue)
    assertEquals("sms", Must-bCapability.Sms.rawValue)
    assertEquals("device", Must-bCapability.Device.rawValue)
    assertEquals("notifications", Must-bCapability.Notifications.rawValue)
    assertEquals("system", Must-bCapability.System.rawValue)
    assertEquals("photos", Must-bCapability.Photos.rawValue)
    assertEquals("contacts", Must-bCapability.Contacts.rawValue)
    assertEquals("calendar", Must-bCapability.Calendar.rawValue)
    assertEquals("motion", Must-bCapability.Motion.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", Must-bCameraCommand.List.rawValue)
    assertEquals("camera.snap", Must-bCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", Must-bCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", Must-bNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", Must-bNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", Must-bDeviceCommand.Status.rawValue)
    assertEquals("device.info", Must-bDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", Must-bDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", Must-bDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", Must-bSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", Must-bPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", Must-bContactsCommand.Search.rawValue)
    assertEquals("contacts.add", Must-bContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", Must-bCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", Must-bCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", Must-bMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", Must-bMotionCommand.Pedometer.rawValue)
  }
}
