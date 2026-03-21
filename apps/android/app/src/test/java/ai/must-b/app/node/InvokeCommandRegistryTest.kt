package ai.must-b.app.node

import ai.must-b.app.protocol.MustBCalendarCommand
import ai.must-b.app.protocol.MustBCameraCommand
import ai.must-b.app.protocol.MustBCapability
import ai.must-b.app.protocol.MustBContactsCommand
import ai.must-b.app.protocol.MustBDeviceCommand
import ai.must-b.app.protocol.MustBLocationCommand
import ai.must-b.app.protocol.MustBMotionCommand
import ai.must-b.app.protocol.MustBNotificationsCommand
import ai.must-b.app.protocol.MustBPhotosCommand
import ai.must-b.app.protocol.MustBSmsCommand
import ai.must-b.app.protocol.MustBSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      MustBCapability.Canvas.rawValue,
      MustBCapability.Device.rawValue,
      MustBCapability.Notifications.rawValue,
      MustBCapability.System.rawValue,
      MustBCapability.Photos.rawValue,
      MustBCapability.Contacts.rawValue,
      MustBCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      MustBCapability.Camera.rawValue,
      MustBCapability.Location.rawValue,
      MustBCapability.Sms.rawValue,
      MustBCapability.VoiceWake.rawValue,
      MustBCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      MustBDeviceCommand.Status.rawValue,
      MustBDeviceCommand.Info.rawValue,
      MustBDeviceCommand.Permissions.rawValue,
      MustBDeviceCommand.Health.rawValue,
      MustBNotificationsCommand.List.rawValue,
      MustBNotificationsCommand.Actions.rawValue,
      MustBSystemCommand.Notify.rawValue,
      MustBPhotosCommand.Latest.rawValue,
      MustBContactsCommand.Search.rawValue,
      MustBContactsCommand.Add.rawValue,
      MustBCalendarCommand.Events.rawValue,
      MustBCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      MustBCameraCommand.Snap.rawValue,
      MustBCameraCommand.Clip.rawValue,
      MustBCameraCommand.List.rawValue,
      MustBLocationCommand.Get.rawValue,
      MustBMotionCommand.Activity.rawValue,
      MustBMotionCommand.Pedometer.rawValue,
      MustBSmsCommand.Send.rawValue,
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

    assertTrue(commands.contains(MustBMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(MustBMotionCommand.Pedometer.rawValue))
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
