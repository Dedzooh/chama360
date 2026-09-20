import { Navigate } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import { WizardLayout } from "../../components/wizard/WizardLayout";

export const CreateChama = () => {
  return <WizardLayout />;
};

export const CreateChamaRoot = () => <Navigate to={ROUTES.createChama.type} replace />;

