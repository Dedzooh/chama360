import fs from 'fs';
const path = 'G:/chama/client/src/context/OrganizationWorkspaceContext.tsx';
let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
text = text.replace(
  "    } catch (fetchError) {\n      console.error('Failed to load organizations', fetchError);\n      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organizations');\n      setOrganizations([]);\n      setCurrentOrganization(null);\n    } finally {",
  "    } catch (fetchError) {\n      console.error('Failed to load organizations', fetchError);\n      const status = (fetchError as any)?.response?.status;\n      if (status === 403) {\n        setError('Access denied to this Chama workspace');\n      } else if (status === 404) {\n        setError('Chama not found');\n      } else {\n        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organizations');\n      }\n      setOrganizations([]);\n      setCurrentOrganization(null);\n    } finally {"
);
fs.writeFileSync(path, text.replace(/\n/g, '\r\n'));
