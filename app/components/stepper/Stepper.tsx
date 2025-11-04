import { useState } from 'react';
import { Button, Group, Stepper } from '@mantine/core';

function Navigation({ activeStep = 1, onPrevStep }: any) {
  const [active, setActive] = useState(activeStep);
  //   const nextStep = () => {
  //     onNextStep();
  //     setActive((current: number) => (current < 3 ? current + 1 : current));
  //   };
  const prevStep = () => {
    onPrevStep();
    setActive((current: number) => (current > 0 ? current - 1 : current));
  };

  return (
    <div className="nav-wrapper">
      <Stepper active={active} onStepClick={setActive} size="xs">
        <Stepper.Step label="First step" description="Fill trip details" />
        <Stepper.Step label="Second step" description="Select interesting matches" />
        <Stepper.Step label="Final step" description="Get matches summary" />
        <Stepper.Completed>Completed, click back button to get to previous step</Stepper.Completed>
      </Stepper>

      <Group justify="center" mt="xl">
        {activeStep !== 1 && (
          <Button variant="default" onClick={prevStep}>
            Back
          </Button>
        )}
      </Group>
    </div>
  );
}

export default Navigation;
