import { useMutation } from '@tanstack/react-query';
import { lookupBook } from '../lib/api';

export function useBookLookup() {
  return useMutation({ mutationFn: lookupBook });
}
