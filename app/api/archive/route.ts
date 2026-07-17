import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const date = searchParams.get('date') // Expected in format 'YYYY-MM-DD'
    const hourVal = searchParams.get('hour')
    const closest = searchParams.get('closest') === 'true'

    if (!channelId || !date) {
      return NextResponse.json(
        { error: 'Missing channelId or date parameter' },
        { status: 400 }
      )
    }

    if (closest) {
      const hour = hourVal !== null ? parseInt(hourVal, 10) : 0
      const targetTimestamp = `${date} ${hour.toString().padStart(2, '0')}:00:00`
      console.log(`[api/archive] Querying closest DB record for Channel: ${channelId}, Target: ${targetTimestamp}`)

      const dbResult = await query(
        `SELECT id, channel_id, date, hour, video_s3_url, csv_s3_url, local_video_path, local_csv_path 
         FROM public.upload_videos 
         WHERE channel_id = $1 
         ORDER BY ABS(EXTRACT(EPOCH FROM (date + (hour || ' hours')::interval)) - EXTRACT(EPOCH FROM ($2::timestamp))) ASC 
         LIMIT 1`,
        [channelId, targetTimestamp]
      )

      if (dbResult.rows.length === 0) {
        return NextResponse.json({ record: null })
      }

      const row = dbResult.rows[0]
      return NextResponse.json({
        record: {
          id: row.id,
          channelId: row.channel_id,
          date: row.date,
          hour: row.hour,
          videoS3Url: row.video_s3_url,
          csvS3Url: row.csv_s3_url,
          localVideoPath: row.local_video_path,
          localCsvPath: row.local_csv_path,
        }
      })
    }

    if (hourVal !== null) {
      const hour = parseInt(hourVal, 10)
      if (isNaN(hour)) {
        return NextResponse.json(
          { error: 'Invalid hour parameter' },
          { status: 400 }
        )
      }

      console.log(`[api/archive] Querying DB for Channel: ${channelId}, Date: ${date}, Hour: ${hour}`)

      // Query database for the specific hour block
      const dbResult = await query(
        `SELECT id, channel_id, date, hour, video_s3_url, csv_s3_url, local_video_path, local_csv_path 
         FROM public.upload_videos 
         WHERE channel_id = $1 AND date = $2::date AND hour = $3 
         LIMIT 1`,
        [channelId, date, hour]
      )

      if (dbResult.rows.length === 0) {
        return NextResponse.json({ record: null })
      }

      const row = dbResult.rows[0]

      return NextResponse.json({
        record: {
          id: row.id,
          channelId: row.channel_id,
          date: row.date,
          hour: row.hour,
          videoS3Url: row.video_s3_url,
          csvS3Url: row.csv_s3_url,
          localVideoPath: row.local_video_path,
          localCsvPath: row.local_csv_path,
        },
      })
    } else {
      console.log(`[api/archive] Querying DB for all rows of Channel: ${channelId}, Date: ${date}`)
      
      const dbResult = await query(
        `SELECT id, channel_id, date, hour, video_s3_url, csv_s3_url, local_video_path, local_csv_path 
         FROM public.upload_videos 
         WHERE channel_id = $1 AND date = $2::date
         ORDER BY hour ASC`,
        [channelId, date]
      )

      const records = dbResult.rows.map(row => ({
        id: row.id,
        channelId: row.channel_id,
        date: row.date,
        hour: row.hour,
        videoS3Url: row.video_s3_url,
        csvS3Url: row.csv_s3_url,
        localVideoPath: row.local_video_path,
        localCsvPath: row.local_csv_path,
      }))

      return NextResponse.json({ records })
    }
  } catch (error: any) {
    console.error('[api/archive] Server Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
