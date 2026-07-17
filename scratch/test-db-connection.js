import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '127.0.0.1',
  port: 5433,
  database: 'labeling_tool',
  user: 'labeling_tool_ec2_user',
  password: 'LabelingToolEc2User@019283',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected!');

    console.log('Unique Channel IDs:');
    const channels = await client.query('SELECT DISTINCT channel_id FROM public.upload_videos ORDER BY channel_id');
    console.log(channels.rows.map(r => r.channel_id));

    console.log('Date range in DB:');
    const dates = await client.query('SELECT MIN(date), MAX(date) FROM public.upload_videos');
    console.log(dates.rows[0]);

    console.log('Sample rows count:');
    const total = await client.query('SELECT COUNT(*) FROM public.upload_videos');
    console.log(total.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
