package com.callerid.app.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class CallerOverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null

    private lateinit var tvName: TextView
    private lateinit var tvPhone: TextView
    private lateinit var tvRiskBadge: TextView
    private lateinit var tvSpamMetrics: TextView

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val phoneNumber = intent?.getStringExtra(EXTRA_PHONE_NUMBER) ?: "Unknown Number"
        val name = intent?.getStringExtra(EXTRA_CALLER_NAME) ?: "Searching..."
        val riskLevel = intent?.getStringExtra(EXTRA_RISK_LEVEL) ?: "UNKNOWN"
        val spamScore = intent?.getIntExtra(EXTRA_SPAM_SCORE, -1) ?: -1
        val totalReports = intent?.getIntExtra(EXTRA_TOTAL_REPORTS, 0) ?: 0

        if (overlayView == null) {
            createOverlayWindow()
        }

        updateUI(phoneNumber, name, riskLevel, spamScore, totalReports)
        return START_NOT_STICKY
    }

    private fun createOverlayWindow() {
        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 100 // Top padding offset
        }

        overlayView = buildOverlayView()
        windowManager.addView(overlayView, layoutParams)
    }

    private fun buildOverlayView(): View {
        val context = this
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 32, 40, 32)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1E293B")) // Sleek Dark slate color
                cornerRadius = 36f
                setStroke(4, Color.parseColor("#334155"))
            }
            elevation = 20f
        }

        // Header Row: Caller Name & Risk Badge
        val headerRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        tvName = TextView(context).apply {
            text = "Searching..."
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        tvRiskBadge = TextView(context).apply {
            text = "SEARCHING"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            setPadding(20, 8, 20, 8)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#64748B"))
                cornerRadius = 16f
            }
        }

        headerRow.addView(tvName)
        headerRow.addView(tvRiskBadge)

        // Subtitle Row: Phone Number & Metrics
        tvPhone = TextView(context).apply {
            text = "+1234567890"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(0, 8, 0, 4)
        }

        tvSpamMetrics = TextView(context).apply {
            text = "Querying live spam registry..."
            setTextColor(Color.parseColor("#CBD5E1"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(0, 0, 0, 20)
        }

        // Action Buttons Row
        val buttonRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        val btnBlock = Button(context).apply {
            text = "Block"
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#EF4444")) // Crimson Red
                cornerRadius = 20f
            }
            layoutParams = LinearLayout.LayoutParams(0, 110, 1f).apply { setMargins(0, 0, 12, 0) }
            setOnClickListener {
                Toast.makeText(context, "Call Blocked", Toast.LENGTH_SHORT).show()
                removeOverlayAndStop()
            }
        }

        val btnReport = Button(context).apply {
            text = "Report Spam"
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#F59E0B")) // Amber Warning
                cornerRadius = 20f
            }
            layoutParams = LinearLayout.LayoutParams(0, 110, 1f).apply { setMargins(6, 0, 6, 0) }
            setOnClickListener {
                Toast.makeText(context, "Reported as Spam", Toast.LENGTH_SHORT).show()
                removeOverlayAndStop()
            }
        }

        val btnClose = Button(context).apply {
            text = "Close"
            setTextColor(Color.parseColor("#94A3B8"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#334155")) // Muted Gray
                cornerRadius = 20f
            }
            layoutParams = LinearLayout.LayoutParams(0, 110, 1f).apply { setMargins(12, 0, 0, 0) }
            setOnClickListener {
                removeOverlayAndStop()
            }
        }

        buttonRow.addView(btnBlock)
        buttonRow.addView(btnReport)
        buttonRow.addView(btnClose)

        root.addView(headerRow)
        root.addView(tvPhone)
        root.addView(tvSpamMetrics)
        root.addView(buttonRow)

        return root
    }

    private fun updateUI(phone: String, name: String, riskLevel: String, spamScore: Int, totalReports: Int) {
        tvPhone.text = phone
        tvName.text = name

        val (badgeText, badgeBgColor) = when (riskLevel.uppercase()) {
            "SAFE" -> Pair("SAFE", "#10B981")          // Emerald Green
            "LOW_RISK" -> Pair("LOW RISK", "#3B82F6")   // Blue
            "SUSPECTED_SPAM" -> Pair("SUSPECTED SPAM", "#F59E0B") // Amber
            "HIGH_RISK_SPAM" -> Pair("SPAM ALERT", "#EF4444")     // Red
            else -> Pair("SEARCHING...", "#64748B")     // Slate Gray
        }

        tvRiskBadge.text = badgeText
        (tvRiskBadge.background as? GradientDrawable)?.setColor(Color.parseColor(badgeBgColor))

        if (spamScore >= 0) {
            tvSpamMetrics.text = "Spam Score: $spamScore/100 • Reports: $totalReports"
        } else {
            tvSpamMetrics.text = "Searching online registry (<1.5s limit)..."
        }
    }

    private fun removeOverlayAndStop() {
        overlayView?.let {
            windowManager.removeView(it)
            overlayView = null
        }
        stopSelf()
    }

    override fun onDestroy() {
        removeOverlayAndStop()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_PHONE_NUMBER = "extra_phone_number"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
        const val EXTRA_RISK_LEVEL = "extra_risk_level"
        const val EXTRA_SPAM_SCORE = "extra_spam_score"
        const val EXTRA_TOTAL_REPORTS = "extra_total_reports"

        fun start(context: Context, phone: String, name: String?, riskLevel: String?, spamScore: Int?, totalReports: Int?) {
            val intent = Intent(context, CallerOverlayService::class.java).apply {
                putExtra(EXTRA_PHONE_NUMBER, phone)
                putExtra(EXTRA_CALLER_NAME, name)
                putExtra(EXTRA_RISK_LEVEL, riskLevel)
                putExtra(EXTRA_SPAM_SCORE, spamScore ?: -1)
                putExtra(EXTRA_TOTAL_REPORTS, totalReports ?: 0)
            }
            context.startService(intent)
        }
    }
}
