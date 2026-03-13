package ai.must-b.app.ui

import androidx.compose.runtime.Composable
import ai.must-b.app.MainViewModel
import ai.must-b.app.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
