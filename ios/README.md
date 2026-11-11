# Abao for iOS

A native shell around the Abao web app that adds what a web page cannot do on iPhone:

- **Dynamic Island and Lock Screen Live Activity**: "正在問小明本人…" while Abao checks with family, then the answer.
- **Native notifications** for the parent (family's answer) and for the family member (a question is waiting).

The screens are the live web app (`https://abao.vercel.app`) in a `WKWebView`; `Guardian.swift` watches the
conversation through the same API and drives the Live Activity.

## Build

```sh
brew install xcodegen   # once
cd ios && xcodegen && open Abao.xcodeproj
```

Run the `Abao` scheme on an iPhone 15 Pro (or newer) simulator, or on a device after choosing your Team under
Signing & Capabilities for both targets.
