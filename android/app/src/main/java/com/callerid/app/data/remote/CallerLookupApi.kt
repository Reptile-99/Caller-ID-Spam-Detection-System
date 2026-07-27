package com.callerid.app.data.remote

import com.google.gson.annotations.SerializedName
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

data class CallerResponse(
    @SerializedName("phone_number") val phoneNumber: String,
    @SerializedName("name") val name: String,
    @SerializedName("spam_score") val spamScore: Int,
    @SerializedName("risk_level") val riskLevel: String,
    @SerializedName("total_reports") val totalReports: Int,
    @SerializedName("total_submissions") val totalSubmissions: Int? = 0
)

data class TopSpamResponse(
    @SerializedName("count") val count: Int,
    @SerializedName("items") val items: List<CallerResponse>
)

interface CallerLookupApi {

    @GET("api/v1/lookup")
    suspend fun lookupCaller(
        @Query("phone") phone: String
    ): retrofit2.Response<CallerResponse>

    @GET("api/v1/top-spam")
    suspend fun getTopSpamNumbers(
        @Query("limit") limit: Int = 5000
    ): retrofit2.Response<TopSpamResponse>

    companion object {
        private const val BASE_URL = "https://your-supabase-project.supabase.co/functions/v1/"

        fun create(): CallerLookupApi {
            val okHttpClient = OkHttpClient.Builder()
                .connectTimeout(1500, TimeUnit.MILLISECONDS)
                .readTimeout(1500, TimeUnit.MILLISECONDS)
                .writeTimeout(1500, TimeUnit.MILLISECONDS)
                .callTimeout(1500, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(false)
                .build()

            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(CallerLookupApi::class.java)
        }
    }
}
