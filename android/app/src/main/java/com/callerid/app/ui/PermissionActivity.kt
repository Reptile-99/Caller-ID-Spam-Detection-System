package com.callerid.app.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class PermissionActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var btnEnableScreeningRole: Button
    private lateinit var btnEnableOverlay: Button
    private lateinit var btnGrantRuntimePermissions: Button

    // 1. RoleManager Contract launcher for ROLE_CALL_SCREENING
    private val callScreeningRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            Toast.makeText(this, "Call Screening Role Granted!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Call Screening Role Denied", Toast.LENGTH_SHORT).show()
        }
        updatePermissionStatusUI()
    }

    // 2. Overlay Settings Launcher
    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        updatePermissionStatusUI()
    }

    // 3. Runtime Permissions Launcher
    private val runtimePermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            Toast.makeText(this, "All permissions granted!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Some permissions were denied", Toast.LENGTH_SHORT).show()
        }
        updatePermissionStatusUI()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate()

        // Construct Permission Management Screen UI programmatically
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply {
            text = "Caller ID & Spam Detector Setup"
            textSize = 22f
            setPadding(0, 0, 0, 24)
        }

        tvStatus = TextView(this).apply {
            textSize = 14f
            setPadding(0, 0, 0, 32)
        }

        btnEnableScreeningRole = Button(this).apply {
            text = "1. Enable Call Screening Role"
            setOnClickListener { requestCallScreeningRole() }
        }

        btnEnableOverlay = Button(this).apply {
            text = "2. Grant System Alert Overlay Permission"
            setOnClickListener { requestOverlayPermission() }
        }

        btnGrantRuntimePermissions = Button(this).apply {
            text = "3. Grant Phone & Contacts Permissions"
            setOnClickListener { requestRuntimePermissions() }
        }

        root.addView(title)
        root.addView(tvStatus)
        root.addView(btnEnableScreeningRole)
        root.addView(btnEnableOverlay)
        root.addView(btnGrantRuntimePermissions)

        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        updatePermissionStatusUI()
    }

    private fun updatePermissionStatusUI() {
        val hasScreeningRole = isCallScreeningRoleGranted()
        val hasOverlay = Settings.canDrawOverlays(this)
        val hasRuntime = hasRequiredRuntimePermissions()

        val statusText = buildString {
            append("Permission Status:\n")
            append("• Call Screening Role: ").append(if (hasScreeningRole) "GRANTED ✅" else "MISSING ❌").append("\n")
            append("• System Overlay Permission: ").append(if (hasOverlay) "GRANTED ✅" else "MISSING ❌").append("\n")
            append("• Phone & Contacts Permissions: ").append(if (hasRuntime) "GRANTED ✅" else "MISSING ❌")
        }

        tvStatus.text = statusText
    }

    private fun isCallScreeningRoleGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
            roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        } else {
            true // Prior to API 29, standard CallScreeningService permission applies
        }
    }

    private fun requestCallScreeningRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
            if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                callScreeningRoleLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Call Screening Role unavailable on this device", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun requestOverlayPermission() {
        if (!Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            overlayPermissionLauncher.launch(intent)
        } else {
            Toast.makeText(this, "Overlay Permission already granted!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun hasRequiredRuntimePermissions(): Boolean {
        val requiredPermissions = arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE
        )
        return requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestRuntimePermissions() {
        val requiredPermissions = arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE
        )
        runtimePermissionsLauncher.launch(requiredPermissions)
    }
}
