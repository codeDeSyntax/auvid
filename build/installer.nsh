; Kill the running app before NSIS installs the update so that app.asar is not locked
!macro customInit
  nsExec::ExecToLog 'taskkill /f /im "his-voice.exe"'
!macroend
