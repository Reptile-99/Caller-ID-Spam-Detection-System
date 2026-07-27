package com.callerid.app.data.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SpamSyncScheduler {

    private const val WORK_NAME = "daily_top_spam_sync_work"

    /**
     * Schedules a recurring WorkManager job that runs once daily under optimal device constraints:
     * - Network must be CONNECTED
     * - Battery must NOT be low
     */
    fun scheduleDailySync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        val dailySyncRequest = PeriodicWorkRequestBuilder<DailySpamSyncWorker>(1, TimeUnit.DAYS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP, // Keep existing schedule if already enqueued
            dailySyncRequest
        )
    }
}
