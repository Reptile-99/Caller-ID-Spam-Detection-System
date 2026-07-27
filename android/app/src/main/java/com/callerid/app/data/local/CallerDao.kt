package com.callerid.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface CallerDao {
    @Query("SELECT * FROM cached_callers WHERE phoneNumber = :phoneNumber LIMIT 1")
    suspend fun getCaller(phoneNumber: String): CallerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(caller: CallerEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(callers: List<CallerEntity>)

    @Transaction
    suspend fun replaceTopSpamList(topSpamCallers: List<CallerEntity>) {
        // Option to purge previous top spam entries or replace them atomically
        insertAll(topSpamCallers)
    }

    @Query("DELETE FROM cached_callers WHERE isTopSpam = 0 AND lastUpdated < :expiryTimestamp")
    suspend fun deleteExpiredCache(expiryTimestamp: Long)

    @Query("SELECT COUNT(*) FROM cached_callers")
    suspend fun getCachedCount(): Int
}
