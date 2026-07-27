package com.callerid.app.data.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.callerid.app.data.local.CallerDatabase
import com.callerid.app.data.local.CallerEntity
import com.callerid.app.data.remote.CallerLookupApi

class DailySpamSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "Starting daily background spam list synchronization job...")

        val db = CallerDatabase.getInstance(applicationContext)
        val api = CallerLookupApi.create()

        return try {
            // Fetch top 5,000 most reported local spam numbers from Supabase backend
            val response = api.getTopSpamNumbers(limit = 5000)

            if (response.isSuccessful && response.body() != null) {
                val topSpamItems = response.body()!!.items
                Log.d(TAG, "Successfully downloaded ${topSpamItems.size} top spam records from backend.")

                val entities = topSpamItems.map { item ->
                    CallerEntity(
                        phoneNumber = item.phoneNumber,
                        name = item.name,
                        spamScore = item.spamScore,
                        riskLevel = item.riskLevel,
                        totalReports = item.totalReports,
                        isTopSpam = true,
                        lastUpdated = System.currentTimeMillis()
                    )
                }

                // Execute atomic set-based bulk upsert into Room DB
                db.callerDao().replaceTopSpamList(entities)

                // Maintenance: Delete non-top-spam cache entries older than 30 days
                val thirtyDaysAgo = System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000)
                db.callerDao().deleteExpiredCache(thirtyDaysAgo)

                Log.d(TAG, "Daily Spam Sync completed successfully. Total cached records: ${db.callerDao().getCachedCount()}")
                Result.success()
            } else {
                Log.e(TAG, "Failed to download top spam list. HTTP status: ${response.code()}")
                if (runAttemptCount < 3) Result.retry() else Result.failure()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing DailySpamSyncWorker", e)
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val TAG = "DailySpamSyncWorker"
    }
}
