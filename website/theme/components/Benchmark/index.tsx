import {
  Benchmark as BaseBenchmark,
  type BenchmarkData,
} from '@rstack-dev/doc-ui/benchmark';
import { useI18n } from '../../i18n';
import styles from './index.module.scss';

// Benchmark data for different cases
// Unit: second
// From: https://github.com/rspack-contrib/performance-compare
const BENCHMARK_DATA: BenchmarkData = {
  rspack: {
    label: 'Rspack',
    metrics: [
      {
        time: 0.41,
        desc: 'dev',
      },
      {
        time: 0.28,
        desc: 'build',
      },
      {
        time: 0.08,
        desc: 'hmr',
      },
    ],
  },
  viteSwc: {
    label: 'Vite + SWC',
    metrics: [
      {
        time: 1.29,
        desc: 'dev',
      },
      {
        time: 1.39,
        desc: 'build',
      },
      {
        time: 0.05,
        desc: 'hmr',
      },
    ],
  },
  webpackSwc: {
    label: 'webpack + SWC',
    metrics: [
      {
        time: 2.26,
        desc: 'dev',
      },
      {
        time: 2.01,
        desc: 'build',
      },
      {
        time: 0.2,
        desc: 'hmr',
      },
    ],
  },
  webpackBabel: {
    label: 'webpack + Babel',
    metrics: [
      {
        time: 5.02,
        desc: 'dev',
      },
      {
        time: 6.52,
        desc: 'build',
      },
      {
        time: 0.2,
        desc: 'hmr',
      },
    ],
  },
};

export function Benchmark() {
  const t = useI18n();

  return (
    <div className="relative flex flex-col justify-center pt-24 pb-10 h-auto">
      <div className="flex flex-center flex-col">
        <h2 className={`${styles.title} font-bold text-3xl sm:text-5xl mt-16`}>
          {t('benchmarkTitle')}
        </h2>
        <p
          className={`${styles.desc} mt-8 mb-5 mx-6 text-center text-lg max-w-3xl`}
        >
          {t('benchmarkDesc')}
        </p>
      </div>
      <BaseBenchmark data={BENCHMARK_DATA} />
      <div className="flex flex-col items-center">
        <a
          href="https://github.com/rspack-contrib/performance-compare"
          target="_blank"
          className={`${styles.bottomLink} hover:text-brand transition-colors duration-300 font-medium p-2`}
          rel="noreferrer"
        >
          👉 {t('benchmarkDetail')}
        </a>
      </div>
    </div>
  );
}
