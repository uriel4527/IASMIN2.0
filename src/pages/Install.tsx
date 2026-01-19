import React from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone } from 'lucide-react';
const Install = () => {
  const {
    installApp,
    isInstallable,
    isInstalled
  } = usePWA();
  const handleInstall = async () => {
    const result = await installApp();
    if (result === 'accepted') {
      console.log('PWA instalado com sucesso!');
    } else if (result === 'dismissed') {
      console.log('Usuário cancelou a instalação');
    } else {
      console.log('Instalação não disponível');
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Instalar Flype Bird</CardTitle>
          <CardDescription>Desenvolvido por Ura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                O app já está instalado em seu dispositivo!
              </p>
              <Button variant="outline" className="w-full" disabled>
                ✓ App Instalado
              </Button>
            </div> : isInstallable ? <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="mr-2 h-4 w-4" />
              Instalar App
            </Button> : <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                A instalação não está disponível neste navegador. 
                Tente usar Chrome, Edge ou Safari.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Instalação Indisponível
              </Button>
            </div>}
          
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>• Acesso offline</p>
            <p>• Notificações push</p>
            <p>• Experiência nativa</p>
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default Install;