package ai.must-b.app.node

import ai.must-b.app.protocol.Must-bCalendarCommand
import ai.must-b.app.protocol.Must-bCanvasA2UICommand
import ai.must-b.app.protocol.Must-bCanvasCommand
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
      NodeCapabilitySpec(name = Must-bCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = Must-bCapability.Device.rawValue),
      NodeCapabilitySpec(name = Must-bCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = Must-bCapability.System.rawValue),
      NodeCapabilitySpec(
        name = Must-bCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = Must-bCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = Must-bCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(
        name = Must-bCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = Must-bCapability.Photos.rawValue),
      NodeCapabilitySpec(name = Must-bCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = Must-bCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = Must-bCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = Must-bCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = Must-bSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = Must-bCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = Must-bCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = Must-bLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = Must-bDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bPhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = Must-bMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = Must-bMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = Must-bSmsCommand.Send.rawValue,
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
