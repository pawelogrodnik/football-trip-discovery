'use client';

import { Button } from '@mantine/core';
import { DEFAULT_RADIUS, RADIUS_MULTIPLIER } from '../consts';
import { AutocompleteLoading } from './AutoComplete';
import { DateRange } from './DateRange';
import { SliderInput } from './Slider';

import './form.css';

import { useState } from 'react';

const FORM_ELEMENTS = {
  RADIUS: 'RADIUS',
  LOCATION: 'LOCATION',
  DATES: 'DATES',
};

const isInputDisabled = (formData: any) => {
  const isRadiusFilled = !!formData[FORM_ELEMENTS.RADIUS];
  const isLocationFilled = !!formData[FORM_ELEMENTS.LOCATION];
  const areDatesFilled = !!formData[FORM_ELEMENTS.DATES];
  return !(isRadiusFilled && isLocationFilled && areDatesFilled);
};

const Form = ({
  onFormUpdate,
  onSubmit,
}: {
  onFormUpdate: (payload: any) => void;
  onSubmit: (payload: any) => void;
}) => {
  const [formData, setFormData] = useState<any>({
    [FORM_ELEMENTS.RADIUS]: DEFAULT_RADIUS * RADIUS_MULTIPLIER,
  });

  const handleChange = (name: string, value: { label: string; lat: number; lon: number } | any) => {
    const updatedFormData = { ...formData, [name]: value };
    onFormUpdate(updatedFormData);
    setFormData(updatedFormData);
  };

  const submitForm = () => onSubmit(formData);

  return (
    <div className="form-wrapper">
      <div className="logo-wrapper">
        <img src="/logo.png" alt="" width={150} />
      </div>
      <div className="form-inner">
        <AutocompleteLoading
          onLocationSelect={(loc) => handleChange(FORM_ELEMENTS.LOCATION, loc)}
        />
        <DateRange onDatesChange={(dates) => handleChange(FORM_ELEMENTS.DATES, dates)} />
        <SliderInput onRadiusChange={(radius) => handleChange(FORM_ELEMENTS.RADIUS, radius)} />
        <Button variant="filled" disabled={isInputDisabled(formData)} onClick={submitForm}>
          Search matches
        </Button>
      </div>
    </div>
  );
};

export default Form;
