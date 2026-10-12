import { useAsync } from '../../lib/useAsync';
import { fetchStudioViewerContext } from './studio-api';

export function useStudioViewerContext(slug: string) {
  return useAsync((signal) => fetchStudioViewerContext(slug, signal), [slug]);
}
