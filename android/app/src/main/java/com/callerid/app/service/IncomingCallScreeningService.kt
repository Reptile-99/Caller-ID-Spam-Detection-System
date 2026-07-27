package com.callerid.app.service

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import com.callerid.app.data.local.CallerDatabase
import com.callerid.app.data.local.CallerEntity
import com.callerid.app.data.remote.CallerLookupApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withTimeoutOrNull

class IncomingCallScreeningService : CallScreeningService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var db: CallerDatabase
    private lateinit var api: CallerLookupApi

    override fun onCreate() {
        super.onCreate()
        db = CallerDatabase.getInstance(applicationContext)
        api = CallerLookupApi.create()
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val handle = callDetails.handle
        if (handle == null) {
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        val rawPhoneNumber = handle.schemeSpecificPart ?: ""
        Log.d(TAG, "Incoming Call Intercepted for: $rawPhoneNumber")

        // 1. Instantly respond to Android OS to prevent any ringing delays
        respondToCall(callDetails, CallResponse.Builder().apply {
            setDisallowCall(false)
            setRejectCall(false)
            setSkipCallLog(false)
            setSkipNotification(false)
        }.build())

        // 2. Perform Real-time Caller ID Lookup (Local First -> 1.5s Network Cutoff -> Fallback)
        serviceScope.launch {
            handleCallerIdentification(rawPhoneNumber)
        }
    }

    private suspend fun handleCallerIdentification(phone: String) {
        val callerDao = db.callerDao()

        // ----------------------------------------------------------------------
        // STEP 1: LOCAL FIRST (0ms Delay)
        // Instantly query local SQLite Room DB cache
        // ----------------------------------------------------------------------
        val localMatch = try {
            callerDao.getCaller(phone)
        } catch (e: Exception) {
            Log.e(TAG, "Local Room DB query error", e)
            null
        }

        if (localMatch != null) {
            Log.d(TAG, "Local DB Hit (0ms): ${localMatch.name}")
            CallerOverlayService.start(
                context = applicationContext,
                phone = phone,
                name = localMatch.name,
                riskLevel = localMatch.riskLevel,
                spamScore = localMatch.spamScore,
                totalReports = localMatch.totalReports
            )
            return
        }

        // Show immediate "Searching..." overlay if no local cache exists
        CallerOverlayService.start(
            context = applicationContext,
            phone = phone,
            name = "Searching Caller ID...",
            riskLevel = "SEARCHING",
            spamScore = -1,
            totalReports = 0
        )

        // ----------------------------------------------------------------------
        // STEP 2: NETWORK CUTOFF (Strict 1.5-Second Execution Limit)
        // Trigger async Retrofit call with hard 1500ms coroutine timeout
        // ----------------------------------------------------------------------
        val networkResult = withTimeoutOrNull(NETWORK_TIMEOUT_MS) {
            try {
                val response = api.lookupCaller(phone)
                if (response.isSuccessful && response.body() != null) {
                    response.body()
                } else {
                    Log.w(TAG, "API call returned non-200 status: ${response.code()}")
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network lookup failed or timed out", e)
                null
            }
        }

        // ----------------------------------------------------------------------
        // STEP 3: DYNAMIC OVERLAY UPDATE OR FALLBACK
        // ----------------------------------------------------------------------
        if (networkResult != null) {
            Log.d(TAG, "Network Success within 1.5s: ${networkResult.name}")

            // Persist match into local Room DB for future 0ms instant access
            try {
                callerDao.insertOrUpdate(
                    CallerEntity(
                        phoneNumber = phone,
                        name = networkResult.name,
                        spamScore = networkResult.spamScore,
                        riskLevel = networkResult.riskLevel,
                        totalReports = networkResult.totalReports
                    )
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to cache network result to Room DB", e)
            }

            // Update overlay window with live caller details & spam score
            CallerOverlayService.start(
                context = applicationContext,
                phone = phone,
                name = networkResult.name,
                riskLevel = networkResult.riskLevel,
                spamScore = networkResult.spamScore,
                totalReports = networkResult.totalReports
            )
        } else {
            // STEP 4: FALLBACK TIMEOUT (<1.5s Limit Exceeded)
            Log.w(TAG, "Network request exceeded 1.5s cutoff. Aborting & displaying fallback UI.")
            CallerOverlayService.start(
                context = applicationContext,
                phone = phone,
                name = "Unknown Caller",
                riskLevel = "SAFE",
                spamScore = 0,
                totalReports = 0
            )
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "CallScreeningService"
        private const val NETWORK_TIMEOUT_MS = 1500L
    }
}
