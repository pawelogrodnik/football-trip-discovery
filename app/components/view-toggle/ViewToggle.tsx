import { SegmentedControl } from '@mantine/core';
import { MOBILE_VIEW } from './consts';

import './viewtoggle.css';

const ViewToggle = ({ onChange }: { onChange: (key: string) => void }) => (
  <div className="view-toggle__inner">
    <SegmentedControl
      radius="xl"
      size="md"
      data={[MOBILE_VIEW.LIST_VIEW, MOBILE_VIEW.MAP_VIEW]}
      onChange={onChange}
    />
  </div>
);

export default ViewToggle;
