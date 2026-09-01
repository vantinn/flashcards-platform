import { Loading } from "@/components/ui/loading";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function AppLoading() {
  const dict = getDictionary(await getLocale());
  return <Loading label={dict.common.loading} />;
}
