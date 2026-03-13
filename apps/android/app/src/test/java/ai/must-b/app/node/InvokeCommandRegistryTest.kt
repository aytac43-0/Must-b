package ai.must-b.app.node

import ai.must-b.app.protocol.Must-bCalendarCommand
import ai.must-b.app.protocol.Must-bCameraCommand
import ai.must-b.app.protocol.Must-bCapability
import ai.must-b.app.protocol.Must-bContactsCommand
import ai.must-b.app.protocol.Must-bDeviceCommand
import ai.must-b.app.protocol.Must-bLocationCommand
import ai.must-b.app.protocol.Must-bMotionCommand
import ai.must-b.app.protocol.Must-bNotificationsCommand
import ai.must-b.app.protocol.Must-bPhotosCommand
import ai.must-b.app.protocol.Must-bSmsCommand
import ai.must-b.app.protocol.Must-bSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      Must-bCapability.Canvas.rawValue,
      Must-bCapability.Device.rawValue,
      Must-bCapability.Notifications.rawValue,
      Must-bCapability.System.rawValue,
      Must-bCapability.Photos.rawValue,
      Must-bCapability.Contacts.rawValue,
      Must-bCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      Must-bCapability.Camera.rawValue,
      Must-bCapability.Location.rawValue,
      Must-bCapability.Sms.rawValue,
      Must-bCapability.VoiceWake.rawValue,
      Must-bCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      Must-bDeviceCommand.Status.rawValue,
      Must-bDeviceCommand.Info.rawValue,
      Must-bDeviceCommand.Permissions.rawValue,
      Must-bDeviceCommand.Health.rawValue,
      Must-bNotificationsCommand.List.rawValue,
      Must-bNotificationsCommand.Actions.rawValue,
      Must-bSystemCommand.Notify.rawValue,
      Must-bPhotosCommand.Latest.rawValue,
      Must-bContactsCommand.Search.rawValue,
      Must-bContactsCommand.Add.rawValue,
      Must-bCalendarCommand.Events.rawValue,
      Must-bCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      Must-bCameraCommand.Snap.rawValue,
      Must-bCameraCommand.Clip.rawValue,
      Must-bCameraCommand.List.rawValue,
      Must-bLocationCommand.Get.rawValue,
      Must-bMotionCommand.Activity.rawValue,
      Must-bMotionCommand.Pedometer.rawValue,
      Must-bSmsCommand.Send.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          smsAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          smsAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          smsAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(Must-bMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(Must-bMotionCommand.Pedometer.rawValue))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    smsAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      smsAvailable = smsAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
