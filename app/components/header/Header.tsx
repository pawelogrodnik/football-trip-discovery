'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import { Group, Select } from '@mantine/core';

import './header.css';

const Header = () => {
  const [language, setLanguage] = useState('English');
  console.log('header');
  return (
    <div className="header-wrapper">
      <div className="header-inner">
        <div className="header__logo">
          <Link href="/">
            <div className="logo-wrapper">
              <img src="/logo.png" alt="" width={150} />
            </div>
          </Link>
        </div>
        <div className="header__navigation">
          <Group h="100%" gap={0}>
            <a href="/contact" className="link">
              Contact
            </a>
            <a href="/report-bug" className="link">
              Report a bug
            </a>
          </Group>
        </div>
        <div className="header__language">
          <Select
            placeholder="Pick value"
            data={['English', 'Polish']}
            value={language}
            onChange={(e) => setLanguage(e as string)}
            styles={{ input: { width: 100 } }}
            comboboxProps={{
              withinPortal: true,
              zIndex: 5000,
              position: 'bottom-start',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
