import * as React from 'react';
import {symmetric} from '@localfirst/auth';

export type SlugProps = {
	message: string;
};

export function Slug(props: SlugProps) {
	return <>{symmetric.encrypt(props.message, 'password')}</>;
}
