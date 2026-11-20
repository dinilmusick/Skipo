"""Platform-native mandatory LAN discovery packaged only into native shells.

Peer advertisements contain no credentials and are NEVER sufficient to invoke a
capability. The native runtime must explicitly verify Luth authorization.
"""
from __future__ import annotations
import json

SERVICE_TYPE = "_skipo._tcp."

ANDROID_JAVA = r'''package org.ultrst.skipo.discovery;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Discovery is untrusted metadata, never a network capability authorization. */
@CapacitorPlugin(name = "SkipoDiscovery", permissions = {
  @Permission(alias = "localNetwork", strings = {"android.permission.ACCESS_LOCAL_NETWORK"})
})
public class SkipoDiscoveryPlugin extends Plugin {
  private NsdManager manager;
  private NsdManager.DiscoveryListener listener;
  private static final String TYPE = "_skipo._tcp.";
  private static final String PERMISSION = "android.permission.ACCESS_LOCAL_NETWORK";

  @Override public void load() {
    manager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
  }

  @PluginMethod public void start(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 37 &&
        ContextCompat.checkSelfPermission(getContext(), PERMISSION)
          != PackageManager.PERMISSION_GRANTED) {
      requestPermissionForAlias("localNetwork", call, "permissionReturned");
      return;
    }
    begin(call);
  }

  @PermissionCallback private void permissionReturned(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 37 &&
        ContextCompat.checkSelfPermission(getContext(), PERMISSION)
          != PackageManager.PERMISSION_GRANTED) {
      call.reject("Local network permission denied");
      return;
    }
    begin(call);
  }

  private synchronized void begin(PluginCall call) {
    if (listener != null) {
      JSObject result = new JSObject();
      result.put("status", "active");
      call.resolve(result);
      return;
    }
    if (manager == null) {
      call.reject("Android NSD unavailable");
      return;
    }
    NsdManager.DiscoveryListener next = new NsdManager.DiscoveryListener() {
      @Override public void onDiscoveryStarted(String type) {}
      @Override public void onDiscoveryStopped(String type) {}
      @Override public void onServiceFound(NsdServiceInfo service) {
        if (!service.getServiceType().startsWith("_skipo._tcp")) return;
        String name = service.getServiceName();
        if (name == null || name.length() > 100) return;
        JSObject peer = new JSObject();
        peer.put("serviceName", name);
        peer.put("type", TYPE);
        peer.put("trusted", false);
        notifyListeners("peerFound", peer);
      }
      @Override public void onServiceLost(NsdServiceInfo service) {
        JSObject peer = new JSObject();
        peer.put("serviceName", service.getServiceName());
        peer.put("trusted", false);
        notifyListeners("peerLost", peer);
      }
      @Override public void onStartDiscoveryFailed(String type, int code) {
        listener = null;
        JSObject error = new JSObject();
        error.put("code", code);
        notifyListeners("discoveryError", error);
        try { manager.stopServiceDiscovery(this); } catch (RuntimeException ignored) {}
      }
      @Override public void onStopDiscoveryFailed(String type, int code) {
        JSObject error = new JSObject();
        error.put("code", code);
        notifyListeners("discoveryError", error);
      }
    };
    try {
      manager.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, next);
      listener = next;
      JSObject result = new JSObject();
      result.put("status", "starting");
      call.resolve(result);
    } catch (SecurityException | IllegalArgumentException e) {
      call.reject("NSD blocked by OS policy", null, e);
    } catch (RuntimeException e) {
      call.reject("NSD startup failed", null, e);
    }
  }

  private synchronized void halt() {
    if (listener != null && manager != null) {
      try { manager.stopServiceDiscovery(listener); } catch (RuntimeException ignored) {}
    }
    listener = null;
  }

  @PluginMethod public void stop(PluginCall call) {
    halt();
    call.resolve();
  }

  @Override protected void handleOnDestroy() {
    halt();
    super.handleOnDestroy();
  }
}
'''

ANDROID_MANIFEST = r'''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <!-- Android 17+ requires OS-managed authorization for broad LAN discovery. -->
    <uses-permission android:name="android.permission.ACCESS_LOCAL_NETWORK"/>
</manifest>
'''

ANDROID_GRADLE = r'''apply plugin: 'com.android.library'

android {
    namespace "org.ultrst.skipo.discovery"
    compileSdk project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 36
    defaultConfig {
        minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

repositories { google(); mavenCentral() }
dependencies { implementation project(':capacitor-android') }
'''

IOS_SWIFT = r'''import Foundation
import Capacitor

/// Browses Bonjour service names only. No capabilities become trusted.
@objc(SkipoDiscoveryPlugin)
public class SkipoDiscoveryPlugin: CAPPlugin, CAPBridgedPlugin, NetServiceBrowserDelegate {
    public let identifier = "SkipoDiscoveryPlugin"
    public let jsName = "SkipoDiscovery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var browser: NetServiceBrowser?

    @objc public func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.browser != nil {
                call.resolve(["status": "active"])
                return
            }
            let next = NetServiceBrowser()
            next.delegate = self
            self.browser = next
            next.searchForServices(ofType: "_skipo._tcp.", inDomain: "local.")
            call.resolve(["status": "starting"])
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.browser?.stop()
            self.browser?.delegate = nil
            self.browser = nil
            call.resolve()
        }
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser,
        didFind service: NetService, moreComing: Bool) {
        guard service.name.count <= 100 else { return }
        notifyListeners("peerFound", data: [
            "serviceName": service.name, "type": "_skipo._tcp.",
            "trusted": false
        ])
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser,
        didRemove service: NetService, moreComing: Bool) {
        notifyListeners("peerLost", data: [
            "serviceName": service.name, "trusted": false
        ])
    }

    public func netServiceBrowser(_ browser: NetServiceBrowser,
        didNotSearch errorDict: [String : NSNumber]) {
        self.browser?.stop()
        self.browser = nil
        notifyListeners("discoveryError", data: [
            "code": errorDict[NetService.errorCode]?.intValue ?? -1
        ])
    }

    deinit {
        browser?.stop()
        browser?.delegate = nil
    }
}
'''

PACKAGE_SWIFT = r'''// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SkipoDiscovery",
    platforms: [.iOS(.v15)],
    products: [.library(name: "SkipoDiscovery", targets: ["SkipoDiscovery"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git",
                 from: "8.0.0")
    ],
    targets: [.target(
        name: "SkipoDiscovery",
        dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm")],
        path: "ios/Sources/SkipoDiscovery"
    )]
)
'''

PODSPEC = r'''Pod::Spec.new do |s|
  s.name = 'SkipoDiscovery'
  s.version = '0.1.0'
  s.summary = 'Required Skipo native Bonjour discovery'
  s.license = { :type => 'MIT' }
  s.homepage = 'https://github.com/dinilmusick/Skipo'
  s.author = 'ULTRST'
  s.source = { :git => 'https://github.com/dinilmusick/Skipo.git', :tag => 'v0.1.0' }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
'''

PLUGIN_JS = r'''import { registerPlugin } from '@capacitor/core';
export const SkipoDiscovery = registerPlugin('SkipoDiscovery');
'''

BOOTSTRAP_JS = r'''// Generated only into the native app bundle. Never into Cloudflare/Vercel.
(() => {
  let active = false;
  async function activate() {
    if (active) return;
    const plugin = globalThis.Capacitor?.Plugins?.SkipoDiscovery;
    if (!plugin) {
      globalThis.dispatchEvent(new CustomEvent('skipo:discovery-status', {
        detail: { available: false, reason: 'Native SkipoDiscovery plugin not registered' }
      }));
      return;
    }
    try {
      await plugin.addListener('peerFound', (peer) => {
        globalThis.dispatchEvent(new CustomEvent('skipo:peer-found', {
          detail: { ...peer, trusted: false }
        }));
      });
      await plugin.addListener('discoveryError', (error) => {
        globalThis.dispatchEvent(new CustomEvent('skipo:discovery-status', {
          detail: { available: false, reason: 'OS discovery error', error }
        }));
      });
      await plugin.start();
      active = true;
      globalThis.dispatchEvent(new CustomEvent('skipo:discovery-status', {
        detail: { available: true, trusted: false }
      }));
    } catch (error) {
      globalThis.dispatchEvent(new CustomEvent('skipo:discovery-status', {
        detail: { available: false, reason: String(error) }
      }));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate, { once: true });
  } else {
    void activate();
  }
})();
'''


def render_mobile_discovery(target: str) -> dict[str, str]:
    """A local first-party Capacitor plugin with no cloud/native cross-imports."""
    if target not in ("android", "ios"):
        raise ValueError("Only native mobile shells may bundle this plugin")
    package = {
        "name": "@ultrst/skipo-discovery", "version": "0.1.0",
        "private": True, "type": "module", "description": "Skipo native peer browser",
        "main": "dist/index.js", "module": "dist/index.js",
        "files": ["dist", "android", "ios", "Package.swift", "SkipoDiscovery.podspec"],
        "peerDependencies": {"@capacitor/core": "^8.0.0"},
        "capacitor": {"android": {"src": "android"}, "ios": {"src": "ios"}},
    }
    prefix = "native/skipo-discovery/"
    files = {
        prefix + "package.json": json.dumps(package, indent=2) + "\n",
        prefix + "dist/index.js": PLUGIN_JS,
        prefix + "Package.swift": PACKAGE_SWIFT,
        prefix + "SkipoDiscovery.podspec": PODSPEC,
        prefix + "android/build.gradle": ANDROID_GRADLE,
        prefix + "android/src/main/AndroidManifest.xml": ANDROID_MANIFEST,
        prefix + "android/src/main/java/org/ultrst/skipo/discovery/SkipoDiscoveryPlugin.java": ANDROID_JAVA,
        prefix + "ios/Sources/SkipoDiscovery/SkipoDiscoveryPlugin.swift": IOS_SWIFT,
        "web/skipo-native-discovery.js": BOOTSTRAP_JS,
    }
    return files


POSTADD_JS = r'''#!/usr/bin/env node
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
if (!['android', 'ios'].includes(target)) throw new Error('Unsupported native target');
const root = process.cwd();
if (target === 'android') {
  // The plugin's AndroidManifest.xml is merged by Gradle. Never disable
  // OS permission checks to avoid a platform permission request.
  const path = resolve(root, 'native/skipo-discovery/android/src/main/AndroidManifest.xml');
  if (!readFileSync(path, 'utf8').includes('android.permission.ACCESS_LOCAL_NETWORK')) {
    throw new Error('Skipo NSD permission declaration missing');
  }
} else {
  const path = resolve(root, 'ios/App/App/Info.plist');
  if (lstatSync(path).isSymbolicLink()) throw new Error('Info.plist symlink is unsafe');
  let xml = readFileSync(path, 'utf8');
  const usage = 'NSLocalNetworkUsageDescription';
  const services = 'NSBonjourServices';
  if (!xml.includes('<key>' + usage + '</key>') || !xml.includes('<key>' + services + '</key>')) {
    const before = xml.lastIndexOf('</dict>');
    if (before < 0 || !xml.includes('<plist')) throw new Error('Invalid iOS plist format');
    if (xml.includes('<key>' + usage + '</key>') ||
        xml.includes('<key>' + services + '</key>')) {
      throw new Error('Conflicting native LAN privacy keys must be reconciled manually');
    }
    const fragment = [
      '    <key>NSLocalNetworkUsageDescription</key>',
      '    <string>Discover nearby Skipo applications on your local network.</string>',
      '    <key>NSBonjourServices</key>',
      '    <array><string>_skipo._tcp</string></array>',
      ''
    ].join('\n');
    xml = xml.slice(0, before) + fragment + xml.slice(before);
    writeFileSync(path, xml, 'utf8');
  }
}
console.log('[skipo] Mandatory native discovery permissions installed for ' + target);
'''


# Preserve the application's web bundle but install a mandatory native-only
# bootstrap. The bridge never authorizes invocations based on an advertisement.
_old_render_mobile_discovery = render_mobile_discovery

def render_mobile_discovery(target: str) -> dict[str, str]:
    result = _old_render_mobile_discovery(target)
    result["scripts/skipo-postadd.mjs"] = POSTADD_JS
    return result
