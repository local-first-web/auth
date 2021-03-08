import * as React from 'react';
import { toSlug } from '@thefakeorg/utils';

export interface SlugProps {
  message: string;
}

export function Slug(props: SlugProps) {
  return <>{toSlug(props.message)}</>;
}

export function Bold({ message }: { message: string }) {
  return <b>{message}</b>;
}

export function Zop({ message }: { message: string }) {
  return <i>{message}</i>;
}
