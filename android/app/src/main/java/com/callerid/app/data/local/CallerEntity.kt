package com.callerid.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "cached_callers",
    indices = [
        Index(value = ["phoneNumber"], unique = true),
        Index(value = ["isTopSpam"])
    ]
)
data class CallerEntity(
    @PrimaryKey val phoneNumber: String,
    val name: String,
    val spamScore: Int,
    val riskLevel: String,
    val totalReports: Int,
    val isTopSpam: Boolean = false,
    val lastUpdated: Long = System.currentTimeMillis()
)
