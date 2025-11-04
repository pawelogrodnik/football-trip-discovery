import Form from './Form';

const FormWrapper = (props: {
  onFormUpdate: (payload: any) => void;
  onSubmit: (payload: any) => void;
}) => <Form {...props} />;

export default FormWrapper;
