package ai.must-b.app.protocol

enum class MustBCapability(val rawValue: String) {
  Canvas("canvas"),
  Camera("camera"),
  Sms("sms"),
  VoiceWake("voiceWake"),
  Location("location"),
  Device("device"),
  Notifications("notifications"),
  System("system"),
  Photos("photos"),
  Contacts("contacts"),
  Calendar("calendar"),
  Motion("motion"),
}

enum class MustBCanvasCommand(val rawValue: String) {
  Present("canvas.present"),
  Hide("canvas.hide"),
  Navigate("canvas.navigate"),
  Eval("canvas.eval"),
  Snapshot("canvas.snapshot"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas."
  }
}

enum class MustBCanvasA2UICommand(val rawValue: String) {
  Push("canvas.a2ui.push"),
  PushJSONL("canvas.a2ui.pushJSONL"),
  Reset("canvas.a2ui.reset"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas.a2ui."
  }
}

enum class MustBCameraCommand(val rawValue: String) {
  List("camera.list"),
  Snap("camera.snap"),
  Clip("camera.clip"),
  ;

  companion object {
    const val NamespacePrefix: String = "camera."
  }
}

enum class MustBSmsCommand(val rawValue: String) {
  Send("sms.send"),
  ;

  companion object {
    const val NamespacePrefix: String = "sms."
  }
}

enum class MustBLocationCommand(val rawValue: String) {
  Get("location.get"),
  ;

  companion object {
    const val NamespacePrefix: String = "location."
  }
}

enum class MustBDeviceCommand(val rawValue: String) {
  Status("device.status"),
  Info("device.info"),
  Permissions("device.permissions"),
  Health("device.health"),
  ;

  companion object {
    const val NamespacePrefix: String = "device."
  }
}

enum class MustBNotificationsCommand(val rawValue: String) {
  List("notifications.list"),
  Actions("notifications.actions"),
  ;

  companion object {
    const val NamespacePrefix: String = "notifications."
  }
}

enum class MustBSystemCommand(val rawValue: String) {
  Notify("system.notify"),
  ;

  companion object {
    const val NamespacePrefix: String = "system."
  }
}

enum class MustBPhotosCommand(val rawValue: String) {
  Latest("photos.latest"),
  ;

  companion object {
    const val NamespacePrefix: String = "photos."
  }
}

enum class MustBContactsCommand(val rawValue: String) {
  Search("contacts.search"),
  Add("contacts.add"),
  ;

  companion object {
    const val NamespacePrefix: String = "contacts."
  }
}

enum class MustBCalendarCommand(val rawValue: String) {
  Events("calendar.events"),
  Add("calendar.add"),
  ;

  companion object {
    const val NamespacePrefix: String = "calendar."
  }
}

enum class MustBMotionCommand(val rawValue: String) {
  Activity("motion.activity"),
  Pedometer("motion.pedometer"),
  ;

  companion object {
    const val NamespacePrefix: String = "motion."
  }
}
