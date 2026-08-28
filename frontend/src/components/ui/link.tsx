/*
Catalyst's Link, wired to react-router-dom as the Catalyst docs instruct.

Catalyst components (Badge, Button, TableRow, Pagination) pass `href`, so that
prop name is kept and mapped to react-router's `to`. Absolute URLs fall through
to a plain anchor, since the router should not try to handle them.
*/

import { DataInteractive as HeadlessDataInteractive } from '@headlessui/react'
import React from 'react'
import { Link as RouterLink } from 'react-router-dom'

export const Link = React.forwardRef(function Link(
  { href, ...props }: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const isExternal = /^([a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:')

  return (
    <HeadlessDataInteractive>
      {isExternal ? (
        <a href={href} ref={ref} {...props} />
      ) : (
        <RouterLink to={href} ref={ref} {...props} />
      )}
    </HeadlessDataInteractive>
  )
})
