import Form from './Form';

const FormWrapper = (props: {
  onFormUpdate: (payload: any) => void;
  onSubmit: (payload: any) => void;
  isLoading: boolean;
}) => <Form {...props} />;

export default FormWrapper;
