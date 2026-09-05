import { SegmentedControl } from '@mantine/core';
import { MOBILE_VIEW } from './consts';

import './viewtoggle.css';

export type ViewToggleOption = {
  value: string;
  label: string;
};

type Props = {
  value?: string;
  options?: ViewToggleOption[];
  onChange: (key: string) => void;
  testId?: string;
};

const ViewToggle = ({ value, options, onChange, testId = 'mobile-view-toggle' }: Props) => (
  <div className="view-toggle__inner">
    <SegmentedControl
      radius="xl"
      size="md"
      value={value}
      data={
        options ?? [
          { value: MOBILE_VIEW.LIST_VIEW, label: 'List view' },
          { value: MOBILE_VIEW.MAP_VIEW, label: 'Map view' },
        ]
      }
      onChange={onChange}
      data-testid={testId}
      aria-label="View mode"
    />
  </div>
);

export default ViewToggle;
