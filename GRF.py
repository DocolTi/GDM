from PIL import Image
import tkinter as tk
from tkinter import filedialog
import os

def image_to_grf(image_path):
    # Carrega a imagem e converte para preto e branco
    image = Image.open(image_path).convert('1')

    # Inicializa a string de dados hexadecimal e conta o total de bytes
    hex_data = ''
    total_bytes = 0

    # Processa cada pixel da imagem
    pixels = image.load()
    for y in range(image.height):
        for x in range(0, image.width, 8):
            byte = 0
            for bit in range(8):
                if x + bit < image.width:
                    byte |= (pixels[x + bit, y] < 128) << (7 - bit)
            hex_data += '{:02X}'.format(byte)
            total_bytes += 1

    # Calcula o número de linhas e o número de bytes por linha
    total_lines = image.height
    bytes_per_row = total_bytes // total_lines

    # Extrai o nome base do arquivo sem a extensão para usar como nome do gráfico
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    graphic_name = f"{base_name}.GRF"

    # Gera o comando ~DG
    header = f'~DG{graphic_name},{total_bytes},{bytes_per_row},'
    grf_data = header + hex_data

    # Salva os dados em um arquivo .GRF
    with open(graphic_name, 'w') as grf_file:
        grf_file.write(grf_data)

    print(f"Arquivo {graphic_name} gerado com sucesso.")

def select_image_and_convert():
    root = tk.Tk()
    root.withdraw()  # Esconde a janela principal do Tkinter
    file_path = filedialog.askopenfilename()

    if file_path:
        image_to_grf(file_path)
    else:
        print("Nenhuma imagem selecionada.")

select_image_and_convert()
