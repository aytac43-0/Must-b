package ai.must-b.app.node

import ai.must-b.app.protocol.MustBCalendarCommand
import ai.must-b.app.protocol.MustBCanvasA2UICommand
import ai.must-b.app.protocol.MustBCanvasCommand
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

data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val smsAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val debugBuild: Boolean,
)

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  DebugBuild,
}

enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = MustBCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = MustBCapability.Device.rawValue),
      NodeCapabilitySpec(name = MustBCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = MustBCapability.System.rawValue),
      NodeCapabilitySpec(
        name = MustBCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = MustBCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = MustBCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(
        name = MustBCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = MustBCapability.Photos.rawValue),
      NodeCapabilitySpec(name = MustBCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = MustBCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = MustBCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = MustBCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = MustBSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = MustBCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = MustBCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = MustBLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = MustBDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBPhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = MustBMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = MustBMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = MustBSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SmsAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> {
    return capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.smsAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }
      .map { it.name }
  }

  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> {
    return all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SmsAvailable -> flags.smsAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }
      .map { it.name }
  }
}
