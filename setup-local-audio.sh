#!/bin/bash

# 本地音乐设置脚本

AUDIO_DIR="src-tauri/assets/audio"
TARGET_FILE="$AUDIO_DIR/focus-music.mp3"

echo "==================================="
echo "  专注岛 - 本地音乐设置"
echo "==================================="
echo ""

# 检查目录是否存在
if [ ! -d "$AUDIO_DIR" ]; then
    echo "❌ 错误：找不到音频目录 $AUDIO_DIR"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

echo "请选择操作："
echo "1) 从文件复制音频"
echo "2) 下载示例白噪音（雨声）"
echo "3) 查看当前状态"
echo "4) 删除本地音频"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "请将音频文件拖拽到终端，然后按回车："
        read -e source_file
        
        # 去除可能的引号
        source_file="${source_file//\'/}"
        source_file="${source_file//\"/}"
        
        if [ ! -f "$source_file" ]; then
            echo "❌ 文件不存在: $source_file"
            exit 1
        fi
        
        cp "$source_file" "$TARGET_FILE"
        
        if [ $? -eq 0 ]; then
            size=$(du -h "$TARGET_FILE" | cut -f1)
            echo "✅ 成功！音频文件已复制到 $TARGET_FILE"
            echo "📦 文件大小: $size"
            echo ""
            echo "现在可以启动应用并选择「本地音乐」电台了"
        else
            echo "❌ 复制失败"
            exit 1
        fi
        ;;
        
    2)
        echo ""
        echo "正在下载示例白噪音（雨声）..."
        echo "来源: https://www.soundjay.com"
        
        # 下载一个小的雨声示例（约 1MB）
        curl -L -o "$TARGET_FILE" "https://www.soundjay.com/nature/sounds/rain-01.mp3"
        
        if [ $? -eq 0 ] && [ -f "$TARGET_FILE" ]; then
            size=$(du -h "$TARGET_FILE" | cut -f1)
            echo "✅ 下载成功！"
            echo "📦 文件大小: $size"
            echo ""
            echo "现在可以启动应用并选择「本地音乐」电台了"
        else
            echo "❌ 下载失败，请检查网络连接"
            exit 1
        fi
        ;;
        
    3)
        echo ""
        if [ -f "$TARGET_FILE" ]; then
            size=$(du -h "$TARGET_FILE" | cut -f1)
            echo "✅ 本地音频文件已存在"
            echo "📍 路径: $TARGET_FILE"
            echo "📦 大小: $size"
            
            # 尝试获取音频信息（如果安装了 ffprobe）
            if command -v ffprobe &> /dev/null; then
                echo ""
                echo "🎵 音频信息："
                ffprobe -v quiet -print_format json -show_format "$TARGET_FILE" | grep -E "duration|bit_rate" | head -2
            fi
        else
            echo "❌ 本地音频文件不存在"
            echo "📍 预期路径: $TARGET_FILE"
            echo ""
            echo "请选择选项 1 或 2 来添加音频文件"
        fi
        ;;
        
    4)
        echo ""
        if [ -f "$TARGET_FILE" ]; then
            read -p "确定要删除本地音频文件吗？(y/N): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                rm "$TARGET_FILE"
                echo "✅ 已删除本地音频文件"
            else
                echo "已取消"
            fi
        else
            echo "ℹ️  本地音频文件不存在，无需删除"
        fi
        ;;
        
    *)
        echo "❌ 无效的选项"
        exit 1
        ;;
esac

echo ""
echo "==================================="
