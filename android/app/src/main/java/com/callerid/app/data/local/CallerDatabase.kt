package com.callerid.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [CallerEntity::class], version = 1, exportSchema = false)
abstract class CallerDatabase : RoomDatabase() {
    abstract fun callerDao(): CallerDao

    companion object {
        @Volatile
        private var INSTANCE: CallerDatabase? = null

        fun getInstance(context: Context): CallerDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CallerDatabase::class.java,
                    "caller_id_cache.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
