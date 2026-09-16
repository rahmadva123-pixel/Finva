import React from 'react';
import ConfirmEmailChangeClient from './ConfirmEmailChangeClient';

export default function Page(props: any) {
  const token = props?.searchParams?.token;
  return <ConfirmEmailChangeClient token={token} />;
}
