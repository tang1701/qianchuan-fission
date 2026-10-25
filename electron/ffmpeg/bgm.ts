import { probeDuration, runFfmpeg } from './util'

export async function mixBackgroundMusic(
  videoPath: string,
  bgmPath: string,
  bgmVolumePercent: number,
  outputPath: string,
): Promise<void> {
  const vol = Math.max(0.05, Math.min(1, bgmVolumePercent / 100))
  const dur = await probeDuration(videoPath)
  await runFfmpeg([
    '-y',
    '-i',
    videoPath,
    '-stream_loop',
    '-1',
    '-i',
    bgmPath,
    '-filter_complex',
    `[1:a]volume=${vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-t',
    String(dur),
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    outputPath,
  ]).catch(async () => {
    await runFfmpeg([
      '-y',
      '-i',
      videoPath,
      '-stream_loop',
      '-1',
      '-i',
      bgmPath,
      '-filter_complex',
      `[1:a]volume=${vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`,
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-shortest',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      outputPath,
    ])
  })
}
